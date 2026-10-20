#!/usr/bin/env bash
#
# Brings up the full Finnhub pipeline on a local minikube cluster with one
# command:
#   ./deploy-minikube.sh
#
# Optional: export FINNHUB_TOKEN=... to override the value in
# terraform-k8s/terraform.tfvars.
#
set -euo pipefail

# Always run from the repository root, regardless of the current directory.
ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$ROOT_DIR"

NAMESPACE="finnhub-pipeline"

# 1. Resolve the Finnhub token. An exported FINNHUB_TOKEN wins; otherwise fall
#    back to terraform-k8s/terraform.tfvars (which terraform reads on its own).
TF_VAR_ARGS=()
if [[ -n "${FINNHUB_TOKEN:-}" ]]; then
  TF_VAR_ARGS+=(-var="finnhub_token=${FINNHUB_TOKEN}")
elif [[ ! -f terraform-k8s/terraform.tfvars ]]; then
  echo "Error: set FINNHUB_TOKEN or create terraform-k8s/terraform.tfvars." >&2
  exit 1
fi

# 2. Start minikube if it is not already running.
if ! minikube status --format='{{.Host}}' 2>/dev/null | grep -qx 'Running'; then
  echo "Minikube is not running. Starting it..."
  # For a fresh profile you likely want more resources, e.g.:
  #   minikube delete
  #   minikube start --cpus=4 --memory=8192
  minikube start
fi

# 3. Build the application images directly into minikube's container runtime.
minikube image build \
  -t finnhub-producer:1.0 \
  -f FinnhubProducer/Dockerfile \
  .

minikube image build \
  -t finnhub-stream-processor:1.0 \
  -f StreamProcessor/Dockerfile \
  .

# NOTE: build from inside grafana/ using context "." — invoking this from the
# repo root with a bare `grafana` context silently builds nothing (exit 0) while
# still returning success, which leaves the grafana Deployment without an image.
(
  cd grafana
  minikube image build -t finnhub-grafana:1.0 -f Dockerfile .
)

# 4. Provision the cluster.
terraform -chdir=terraform-k8s init -input=false
terraform -chdir=terraform-k8s apply -auto-approve -input=false "${TF_VAR_ARGS[@]}"

# 5. Wait for the workloads to become ready.
kubectl rollout status statefulset/kafka -n "$NAMESPACE" --timeout=10m
kubectl rollout status statefulset/cassandra -n "$NAMESPACE" --timeout=10m
kubectl rollout status deployment/schema-registry -n "$NAMESPACE" --timeout=10m
kubectl rollout status deployment/kafdrop -n "$NAMESPACE" --timeout=10m
kubectl rollout status deployment/finnhub-producer -n "$NAMESPACE" --timeout=10m
kubectl rollout status deployment/stream-processor -n "$NAMESPACE" --timeout=10m
kubectl rollout status deployment/grafana -n "$NAMESPACE" --timeout=10m

echo
echo "Deployment is ready. Grafana URL:"
minikube service grafana -n "$NAMESPACE" --url
