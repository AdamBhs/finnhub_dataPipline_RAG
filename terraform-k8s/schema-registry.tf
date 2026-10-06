resource "kubernetes_service" "schema_registry" {
  metadata {
    name      = "schema-registry"
    namespace = kubernetes_namespace.pipeline.metadata[0].name
  }

  spec {
    selector = {
      app = "schema-registry"
    }

    port {
      name        = "http"
      port        = 8081
      target_port = 8081
    }

    type = "ClusterIP"
  }
}


resource "kubernetes_deployment" "schema_registry" {
  metadata {
    name      = "schema-registry"
    namespace = kubernetes_namespace.pipeline.metadata[0].name
  }

  spec {
    replicas = 1

    selector {
      match_labels = {
        app = "schema-registry"
      }
    }

    template {
      metadata {
        labels = {
          app = "schema-registry"
        }
      }

      spec {
        enable_service_links = false
        container {
          name  = "schema-registry"
          image = "confluentinc/cp-schema-registry:8.1.1"

          port {
            container_port = 8081
          }

          env_from {
            config_map_ref {
              name = kubernetes_config_map.schema_registry_config.metadata[0].name
            }
          }
        }
      }
    }
  }
}