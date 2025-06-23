resource "kubernetes_service_account" "externaldns_seoul" {
  metadata {
    name      = "external-dns"
    namespace = "kube-system"
    annotations = {
      "eks.amazonaws.com/role-arn" = module.irsa_externaldns_seoul.iam_role_arn
    }
  }

  depends_on = [module.eks_seoul]
  provider   = kubernetes.seoul
}

resource "kubernetes_service_account" "externaldns_tokyo" {
  metadata {
    name      = "external-dns"
    namespace = "kube-system"
    annotations = {
      "eks.amazonaws.com/role-arn" = module.irsa_externaldns_tokyo.iam_role_arn
    }
  }

  depends_on = [module.eks_tokyo]
  provider   = kubernetes.tokyo
}
