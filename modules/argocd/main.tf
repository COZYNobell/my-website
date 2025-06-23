provider "kubernetes" {
  alias = "k8s"
  config_path    = "~/.kube/config"
  config_context = "arn:aws:eks:${var.region}:123456789012:cluster/${var.cluster_name}"
}

provider "helm" {
  alias = "helm"
  kubernetes {
    config_path    = "~/.kube/config"
    config_context = "arn:aws:eks:${var.region}:123456789012:cluster/${var.cluster_name}"
  }
}

resource "helm_release" "argocd" {
  name             = "argocd"
  repository       = "https://argoproj.github.io/argo-helm"
  chart            = "argo-cd"
  version          = "5.52.1"
  namespace        = var.argocd_namespace
  create_namespace = true

  values = [
    file(var.values_file_path)
  ]

  providers = {
    helm = helm
  }
}
