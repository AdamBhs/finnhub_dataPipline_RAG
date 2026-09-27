terraform {
    required_providers {
      kubernetes = {
        source = "hashicorp/kubernetes"
        version = "2.11.0"
      }
      
      # A package manager for k8s, Helm lets you install and manage applications on Kubernetes using Helm Charts.
      helm = {
        source ="hashicorp/helm"
        version = "2.9.0"
      }

      kubectl = {
        source = "gavinbunney/kubectl"
        version = "1.14.0"
      }
    }
}

provider "kubernetes" {
    config_path = pathexpand(var.kube_config)
    config_context = "minikube"
}

provider "helm" {
    kubernetes {
        config_path = pathexpand(var.kube_config)
    }
}

provider "kubectl" {}