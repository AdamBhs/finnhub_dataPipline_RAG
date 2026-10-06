resource "kubernetes_service" "kafdrop" {
  metadata {
    name      = "kafdrop"
    namespace = kubernetes_namespace.pipeline.metadata[0].name
  }

  spec {
    selector = {
      app = "kafdrop"
    }

    port {
      name        = "http"
      port        = 9000
      target_port = 9000
    }

    type = "ClusterIP"
  }
}


resource "kubernetes_deployment" "kafdrop" {
  metadata {
    name      = "kafdrop"
    namespace = kubernetes_namespace.pipeline.metadata[0].name
  }

  spec {
    replicas = 1

    selector {
      match_labels = {
        app = "kafdrop"
      }
    }

    template {
      metadata {
        labels = {
          app = "kafdrop"
        }
      }

      spec {
        container {
          name  = "kafdrop"
          image = "obsidiandynamics/kafdrop:latest"

          port {
            container_port = 9000
          }

          env_from {
            config_map_ref {
              name = kubernetes_config_map.kafdrop_config.metadata[0].name
            }
          }
        }
      }
    }
  }
}