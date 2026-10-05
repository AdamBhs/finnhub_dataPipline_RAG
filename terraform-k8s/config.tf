
resource "kubernetes_config_map" "kafka_config" {
  metadata {
    name      = "kafka-config"
    namespace = kubernetes_namespace.pipeline.metadata[0].name
  }

  data = {
    CLUSTER_ID = "MkU3OEVBNTcwNTJENDM2Qk"

    KAFKA_NODE_ID                        = "1"
    KAFKA_PROCESS_ROLES                  = "broker,controller"
    KAFKA_LISTENERS                      = "PLAINTEXT://:9092,CONTROLLER://:9093"
    KAFKA_ADVERTISED_LISTENERS           = "PLAINTEXT://kafka:9092"
    KAFKA_LISTENER_SECURITY_PROTOCOL_MAP = "CONTROLLER:PLAINTEXT,PLAINTEXT:PLAINTEXT"
    KAFKA_CONTROLLER_LISTENER_NAMES      = "CONTROLLER"
    KAFKA_CONTROLLER_QUORUM_VOTERS       = "1@kafka:9093"
    KAFKA_INTER_BROKER_LISTENER_NAME     = "PLAINTEXT"

    KAFKA_OFFSETS_TOPIC_REPLICATION_FACTOR         = "1"
    KAFKA_TRANSACTION_STATE_LOG_REPLICATION_FACTOR = "1"
    KAFKA_TRANSACTION_STATE_LOG_MIN_ISR            = "1"
    KAFKA_GROUP_INITIAL_REBALANCE_DELAY_MS         = "0"
    KAFKA_NUM_PARTITIONS                           = "3"
  }
}

resource "kubernetes_config_map" "kafdrop_config" {
  metadata {
    name      = "kafdrop-config"
    namespace = kubernetes_namespace.pipeline.metadata[0].name
  }

  data = {
    KAFKA_BROKERCONNECT = "kafka:9092"
    SERVER_PORT         = "9000"
  }
}