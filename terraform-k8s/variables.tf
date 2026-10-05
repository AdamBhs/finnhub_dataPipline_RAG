
variable "kubeconfig_path" {
  description = "Path to the Kubernetes kubeconfig file"
  type        = string
  default     = "~/.kube/config"
}

variable "kube_context" {
  description = "Kubernetes context Terraform should use"
  type        = string
  default     = "minikube"
}

variable "namespace" {
  description = "Namespace for the Finnhub streaming pipeline"
  type        = string
  default     = "finnhub-pipeline"
}