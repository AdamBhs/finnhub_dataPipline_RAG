resource "kubernetes_secret" "finnhub" {
  metadata {
    name      = "finnhub-secret"
    namespace = kubernetes_namespace.pipeline.metadata[0].name
  }

  type = "Opaque"

  data = {
    FINNHUB_TOKEN = var.finnhub_token
  }
}