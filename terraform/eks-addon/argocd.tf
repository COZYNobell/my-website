resource "helm_release" "argocd_seoul" {
  name       = "argocd"
  namespace  = "argocd"
  repository = "https://argoproj.github.io/argo-helm"
  chart      = "argo-cd"
  version    = "5.46.9"

  create_namespace = true
  atomic           = true

  values = []
  kubeconfig = data.aws_eks_cluster_auth.seoul_auth.token
  depends_on = [module.eks_seoul]
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
  kubeconfig = data.aws_eks_cluster_auth.tokyo_auth.token
  depends_on = [module.eks_tokyo]
}
