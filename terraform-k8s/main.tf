resource "kubernetes_namespace" "pipeline" {
  metadata {
    name = var.namespace
  }
}