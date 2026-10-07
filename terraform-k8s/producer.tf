resource "kubernetes_deployment" "finnhub_producer" {
  metadata {
    name      = "finnhub-producer"
    namespace = kubernetes_namespace.pipeline.metadata[0].name
  }

  spec {
    replicas = 1

    selector {
      match_labels = {
        app = "finnhub-producer"
      }
    }

    template {
      metadata {
        labels = {
          app = "finnhub-producer"
        }
      }

      spec {
        container {
          name  = "finnhub-producer"
          image = "finnhub-producer:1.0"

          image_pull_policy = "IfNotPresent"

          env {
            name = "FINNHUB_TOKEN"

            value_from {
              secret_key_ref {
                name = kubernetes_secret.finnhub.metadata[0].name
                key  = "FINNHUB_TOKEN"
              }
            }
          }

          env {
            name  = "KAFKA_BOOTSTRAP_SERVERS"
            value = "kafka:9092"
          }

          env {
            name  = "SCHEMA_REGISTRY_URL"
            value = "http://schema-registry:8081"
          }
        }
      }
    }
  }
}