resource "helm_release" "alb_controller_seoul" {
  name       = "aws-load-balancer-controller"
  namespace  = "kube-system"
  repository = "https://aws.github.io/eks-charts"
  chart      = "aws-load-balancer-controller"
  version    = "1.8.1"

  create_namespace = false
  atomic           = true

  values = [
    yamlencode({
      clusterName = module.eks_seoul.cluster_name
      serviceAccount = {
        create = false
        name   = "aws-load-balancer-controller"
      }
      region = "ap-northeast-2"
      vpcId  = "vpc-01dc2534a77a00126"
    })
  ]

  depends_on = [module.eks_seoul]
  provider   = helm.seoul
}

resource "helm_release" "alb_controller_tokyo" {
  name       = "aws-load-balancer-controller"
  namespace  = "kube-system"
  repository = "https://aws.github.io/eks-charts"
  chart      = "aws-load-balancer-controller"
  version    = "1.8.1"

  create_namespace = false
  atomic           = true

  values = [
    yamlencode({
      clusterName = module.eks_tokyo.cluster_name
      serviceAccount = {
        create = false
        name   = "aws-load-balancer-controller"
      }
      region = "ap-northeast-1"
      vpcId  = "vpc-0631eaad6a10ddfee"
    })
  ]

  depends_on = [module.eks_tokyo]
  provider   = helm.tokyo
}
