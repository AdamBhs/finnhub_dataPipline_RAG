resource "kubernetes_persistent_volume_claim" "stream_processor_checkpoints" {
  metadata {
    name      = "stream-processor-checkpoints"
    namespace = kubernetes_namespace.pipeline.metadata[0].name
  }

  spec {
    access_modes = ["ReadWriteOnce"]

    resources {
      requests = {
        storage = "1Gi"
      }
    }
  }
}

resource "kubernetes_deployment" "stream_processor" {
  metadata {
    name      = "stream-processor"
    namespace = kubernetes_namespace.pipeline.metadata[0].name
  }

  spec {
    replicas = 1

    selector {
      match_labels = {
        app = "stream-processor"
      }
    }

    template {
      metadata {
        labels = {
          app = "stream-processor"
        }
      }

      spec {
        container {
          name  = "stream-processor"
          image = "finnhub-stream-processor:1.0"

          image_pull_policy = "IfNotPresent"

          env {
            name  = "KAFKA_BOOTSTRAP_SERVERS"
            value = "kafka:9092"
          }

          env {
            name  = "CASSANDRA_CONTACT_POINTS"
            value = "cassandra"
          }

          env {
            name  = "CASSANDRA_PORT"
            value = "9042"
          }

          env {
            name  = "SPARK_CHECKPOINT_DIR"
            value = "/app/StreamProcessor/checkpoints/query2"
          }

          resources {
            requests = {
              cpu    = "500m"
              memory = "1Gi"
            }

            limits = {
              cpu    = "1"
              memory = "2Gi"
            }
          }

          volume_mount {
            name       = "checkpoints"
            mount_path = "/app/StreamProcessor/checkpoints"
          }
        }

        volume {
          name = "checkpoints"

          persistent_volume_claim {
            claim_name = kubernetes_persistent_volume_claim.stream_processor_checkpoints.metadata[0].name
          }
        }
      }
    }
  }

  depends_on = [
    kubernetes_job_v1.cassandra_init,
    kubernetes_deployment.schema_registry,
  ]
}
