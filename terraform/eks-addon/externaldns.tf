resource "helm_release" "externaldns_seoul" {
  name       = "external-dns"
  namespace  = "kube-system"
  repository = "https://kubernetes-sigs.github.io/external-dns/"
  chart      = "external-dns"
  version    = "1.14.4"

  create_namespace = false
  atomic           = true

  values = [
    yamlencode({
      provider = "aws"
      region   = "ap-northeast-2"
      zoneType = "public"
      txtOwnerId = "externaldns-seoul"
      policy = "upsert-only"
      serviceAccount = {
        create = false
        name   = "external-dns"
      }
    })
  ]

  depends_on = [module.eks_seoul]
  provider   = helm.seoul
}

resource "helm_release" "externaldns_tokyo" {
  name       = "external-dns"
  namespace  = "kube-system"
  repository = "https://kubernetes-sigs.github.io/external-dns/"
  chart      = "external-dns"
  version    = "1.14.4"

  create_namespace = false
  atomic           = true

  values = [
    yamlencode({
      provider = "aws"
      region   = "ap-northeast-1"
      zoneType = "public"
      txtOwnerId = "externaldns-tokyo"
      policy = "upsert-only"
      serviceAccount = {
        create = false
        name   = "external-dns"
      }
    })
  ]

  depends_on = [module.eks_tokyo]
  provider   = helm.tokyo
}
