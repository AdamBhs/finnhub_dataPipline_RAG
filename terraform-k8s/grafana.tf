resource "kubernetes_persistent_volume_claim" "grafana_data" {
  metadata {
    name      = "grafana-data"
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

resource "kubernetes_service" "grafana" {
  metadata {
    name      = "grafana"
    namespace = kubernetes_namespace.pipeline.metadata[0].name
  }

  spec {
    selector = {
      app = "grafana"
    }

    port {
      name        = "http"
      port        = 3000
      target_port = 3000
    }

    type = "NodePort"
  }
}

resource "kubernetes_deployment" "grafana" {
  metadata {
    name      = "grafana"
    namespace = kubernetes_namespace.pipeline.metadata[0].name
  }

  spec {
    replicas = 1

    selector {
      match_labels = {
        app = "grafana"
      }
    }

    template {
      metadata {
        labels = {
          app = "grafana"
        }
      }

      spec {
        container {
          name  = "grafana"
          image = "finnhub-grafana:1.0"

          image_pull_policy = "IfNotPresent"

          # The PVC below mounts an empty volume over /var/lib/grafana, which
          # masks the plugin baked into the image at build time. Install it at
          # startup so it lands in the mounted (persistent) plugins directory.
          env {
            name  = "GF_INSTALL_PLUGINS"
            value = "hadesarchitect-cassandra-datasource"
          }

          port {
            name           = "http"
            container_port = 3000
          }

          resources {
            requests = {
              cpu    = "100m"
              memory = "256Mi"
            }

            limits = {
              cpu    = "500m"
              memory = "512Mi"
            }
          }

          volume_mount {
            name       = "grafana-data"
            mount_path = "/var/lib/grafana"
          }
        }

        volume {
          name = "grafana-data"

          persistent_volume_claim {
            claim_name = kubernetes_persistent_volume_claim.grafana_data.metadata[0].name
          }
        }
      }
    }
  }

  depends_on = [kubernetes_job_v1.cassandra_init]
}
