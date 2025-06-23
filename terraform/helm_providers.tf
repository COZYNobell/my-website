provider "helm" {
  alias = "seoul"
  kubernetes {
    host                   = module.eks_seoul.cluster_endpoint
    cluster_ca_certificate = base64decode(module.eks_seoul.cluster_certificate_authority_data)
    token                  = data.aws_eks_cluster_auth.seoul_auth.token
  }
}

provider "helm" {
  alias = "tokyo"
  kubernetes {
    host                   = module.eks_tokyo.cluster_endpoint
    cluster_ca_certificate = base64decode(module.eks_tokyo.cluster_certificate_authority_data)
    token                  = data.aws_eks_cluster_auth.tokyo_auth.token
  }
}
