resource "kubernetes_persistent_volume_claim" "kafka_data" {
  metadata {
    name      = "kafka-data"
    namespace = kubernetes_namespace.pipeline.metadata[0].name
  }

  spec {
    access_modes = ["ReadWriteMany"]

    resources {
      requests = {
        storage = "3Gi"
      }
    }
  }
}