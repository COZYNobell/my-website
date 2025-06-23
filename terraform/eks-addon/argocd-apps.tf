resource "kubernetes_manifest" "argocd_app_seoul" {
  manifest = {
    apiVersion = "argoproj.io/v1alpha1"
    kind       = "Application"
    metadata = {
      name      = "weather-app-seoul"
      namespace = "argocd"
    }
    spec = {
      project = "default"
      source = {
        repoURL        = "https://github.com/COZYNobell/Alpha-v2"
        targetRevision = "main"
        path           = "k8s/seoul"
      }
      destination = {
        server    = "https://kubernetes.default.svc"
        namespace = "default"
      }
      syncPolicy = {
        automated = {
          prune = true
          selfHeal = true
        }
        syncOptions = ["CreateNamespace=true"]
      }
    }
  }

  depends_on = [helm_release.argocd_seoul]
  provider   = kubernetes.seoul
}

resource "kubernetes_manifest" "argocd_app_tokyo" {
  manifest = {
    apiVersion = "argoproj.io/v1alpha1"
    kind       = "Application"
    metadata = {
      name      = "weather-app-tokyo"
      namespace = "argocd"
    }
    spec = {
      project = "default"
      source = {
        repoURL        = "https://github.com/COZYNobell/Alpha-v2"
        targetRevision = "main"
        path           = "k8s/tokyo"
      }
      destination = {
        server    = "https://kubernetes.default.svc"
        namespace = "default"
      }
      syncPolicy = {
        automated = {
          prune = true
          selfHeal = true
        }
        syncOptions = ["CreateNamespace=true"]
      }
    }
  }

  depends_on = [helm_release.argocd_tokyo]
  provider   = kubernetes.tokyo
}
