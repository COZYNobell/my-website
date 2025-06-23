data "kubernetes_service" "argocd_seoul" {
  metadata {
    name      = "argocd-server"
    namespace = "argocd"
  }
  depends_on = [helm_release.argocd_seoul]
  provider   = kubernetes.seoul
}

data "kubernetes_service" "argocd_tokyo" {
  metadata {
    name      = "argocd-server"
    namespace = "argocd"
  }
  depends_on = [helm_release.argocd_tokyo]
  provider   = kubernetes.tokyo
}
