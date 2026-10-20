resource "kubernetes_persistent_volume_claim" "cassandra_data" {
  metadata {
    name      = "cassandra-data"
    namespace = kubernetes_namespace.pipeline.metadata[0].name
  }

  spec {
    access_modes = ["ReadWriteOnce"]

    resources {
      requests = {
        storage = "3Gi"
      }
    }
  }
}

resource "kubernetes_service" "cassandra" {
  metadata {
    name      = "cassandra"
    namespace = kubernetes_namespace.pipeline.metadata[0].name
  }

  spec {
    selector = {
      app = "cassandra"
    }

    port {
      name        = "cql"
      port        = 9042
      target_port = 9042
    }

    type = "ClusterIP"
  }
}

resource "kubernetes_stateful_set" "cassandra" {
  metadata {
    name      = "cassandra"
    namespace = kubernetes_namespace.pipeline.metadata[0].name
  }

  spec {
    service_name = kubernetes_service.cassandra.metadata[0].name
    replicas     = 1

    selector {
      match_labels = {
        app = "cassandra"
      }
    }

    template {
      metadata {
        labels = {
          app = "cassandra"
        }
      }

      spec {
        container {
          name  = "cassandra"
          image = "cassandra:5.0"

          port {
            name           = "cql"
            container_port = 9042
          }

          env {
            name  = "CASSANDRA_CLUSTER_NAME"
            value = "FinnhubCluster"
          }

          env {
            name  = "CASSANDRA_DC"
            value = "datacenter1"
          }

          env {
            name  = "CASSANDRA_RACK"
            value = "rack1"
          }

          env {
            name  = "CASSANDRA_ENDPOINT_SNITCH"
            value = "GossipingPropertyFileSnitch"
          }

          env {
            name  = "MAX_HEAP_SIZE"
            value = "512M"
          }

          env {
            name  = "HEAP_NEWSIZE"
            value = "100M"
          }

          resources {
            requests = {
              cpu    = "500m"
              memory = "1Gi"
            }

            limits = {
              cpu    = "1"
              memory = "1Gi"
            }
          }

          volume_mount {
            name       = "cassandra-data"
            mount_path = "/var/lib/cassandra"
          }
        }

        volume {
          name = "cassandra-data"

          persistent_volume_claim {
            claim_name = kubernetes_persistent_volume_claim.cassandra_data.metadata[0].name
          }
        }
      }
    }
  }
}

resource "kubernetes_config_map" "cassandra_schema" {
  metadata {
    name      = "cassandra-schema"
    namespace = kubernetes_namespace.pipeline.metadata[0].name
  }

  data = {
    "init.cql" = file("${path.module}/../Cassandra/scripts/init.cql")
  }
}

resource "kubernetes_job_v1" "cassandra_init" {
  metadata {
    name      = "cassandra-init"
    namespace = kubernetes_namespace.pipeline.metadata[0].name
  }

  spec {
    backoff_limit              = 20
    ttl_seconds_after_finished = 3600

    template {
      metadata {
        labels = {
          app = "cassandra-init"
        }
      }

      spec {
        restart_policy = "OnFailure"

        container {
          name    = "cassandra-init"
          image   = "cassandra:5.0"
          command = ["sh", "-c", "until cqlsh cassandra 9042 -e 'DESCRIBE KEYSPACES' >/dev/null 2>&1; do echo 'Waiting for Cassandra...'; sleep 5; done; cqlsh cassandra 9042 -f /schema/init.cql"]

          volume_mount {
            name       = "schema"
            mount_path = "/schema"
            read_only  = true
          }
        }

        volume {
          name = "schema"

          config_map {
            name = kubernetes_config_map.cassandra_schema.metadata[0].name
          }
        }
      }
    }
  }

  wait_for_completion = true

  # The provider's default create timeout is only 1 minute, which is too short
  # for Cassandra + cqlsh to come up (the job can take ~1-2 minutes). Give it
  # room so a slow cluster doesn't taint the job and abort the apply.
  timeouts {
    create = "15m"
  }

  depends_on = [kubernetes_stateful_set.cassandra]
}
