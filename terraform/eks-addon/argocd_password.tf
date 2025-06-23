data "kubernetes_secret" "argocd_seoul" {
  metadata {
    name      = "argocd-initial-admin-secret"
    namespace = "argocd"
  }
  depends_on = [helm_release.argocd_seoul]
  provider   = kubernetes.seoul
}

data "kubernetes_secret" "argocd_tokyo" {
  metadata {
    name      = "argocd-initial-admin-secret"
    namespace = "argocd"
  }
  depends_on = [helm_release.argocd_tokyo]
  provider   = kubernetes.tokyo
}

output "argocd_seoul_admin_password" {
  value     = base64decode(data.kubernetes_secret.argocd_seoul.data["password"])
  sensitive = true
}

output "argocd_tokyo_admin_password" {
  value     = base64decode(data.kubernetes_secret.argocd_tokyo.data["password"])
  sensitive = true
}
