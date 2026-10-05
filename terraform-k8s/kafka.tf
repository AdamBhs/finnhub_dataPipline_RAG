
resource "kubernetes_service" "kafka" {
  metadata {
    name      = "kafka"
    namespace = kubernetes_namespace.pipeline.metadata[0].name
  }

  spec {
    cluster_ip = "None"

    selector = {
      app = "kafka"
    }

    port {
      name        = "client"
      port        = 9092
      target_port = 9092
    }

    port {
      name        = "controller"
      port        = 9093
      target_port = 9093
    }
  }
}

resource "kubernetes_stateful_set" "kafka" {
  metadata {
    name      = "kafka"
    namespace = kubernetes_namespace.pipeline.metadata[0].name
  }

  spec {
    service_name = kubernetes_service.kafka.metadata[0].name
    replicas     = 1

    selector {
      match_labels = {
        app = "kafka"
      }
    }

    template {
      metadata {
        labels = {
          app = "kafka"
        }
      }

      spec {
        container {
          name  = "kafka"
          image = "apache/kafka:4.1.1"

          port {
            name           = "client"
            container_port = 9092
          }

          port {
            name           = "controller"
            container_port = 9093
          }

          env_from {
            config_map_ref {
              name = kubernetes_config_map.kafka_config.metadata[0].name
            }
          }

          volume_mount {
            name       = "kafka-data"
            mount_path = "/var/lib/kafka/data"
          }
        }

        volume {
          name = "kafka-data"

          persistent_volume_claim {
            claim_name = kubernetes_persistent_volume_claim.kafka_data.metadata[0].name
          }
        }
      }
    }
  }
}