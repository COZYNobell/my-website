resource "helm_release" "argocd_seoul" {
  name       = "argocd"
  namespace  = "argocd"
  repository = "https://argoproj.github.io/argo-helm"
  chart      = "argo-cd"
  version    = "5.46.9"

  create_namespace = true
  atomic           = true

  values = []

  depends_on = [module.eks_seoul]
  provider   = helm.seoul
}

resource "helm_release" "argocd_tokyo" {
  name       = "argocd"
  namespace  = "argocd"
  repository = "https://argoproj.github.io/argo-helm"
  chart      = "argo-cd"
  version    = "5.46.9"

  create_namespace = true
  atomic           = true

  values = []

  depends_on = [module.eks_tokyo]
  provider   = helm.tokyo
}
