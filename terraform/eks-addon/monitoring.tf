resource "helm_release" "monitoring_seoul" {
  name       = "monitoring"
  namespace  = "monitoring"
  repository = "https://prometheus-community.github.io/helm-charts"
  chart      = "kube-prometheus-stack"
  version    = "57.0.3"

  create_namespace = true
  atomic           = true

  values = [
    yamlencode({
      grafana = {
        adminPassword = "admin"
        service = {
          type = "LoadBalancer"
        }
      }
      prometheus = {
        prometheusSpec = {
          serviceMonitorSelectorNilUsesHelmValues = false
        }
      }
    })
  ]

  depends_on = [module.eks_seoul]
  provider   = helm.seoul
}

resource "helm_release" "monitoring_tokyo" {
  name       = "monitoring"
  namespace  = "monitoring"
  repository = "https://prometheus-community.github.io/helm-charts"
  chart      = "kube-prometheus-stack"
  version    = "57.0.3"

  create_namespace = true
  atomic           = true

  values = [
    yamlencode({
      grafana = {
        adminPassword = "admin"
        service = {
          type = "LoadBalancer"
        }
      }
      prometheus = {
        prometheusSpec = {
          serviceMonitorSelectorNilUsesHelmValues = false
        }
      }
    })
  ]

  depends_on = [module.eks_tokyo]
  provider   = helm.tokyo
}
