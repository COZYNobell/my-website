provider "helm" {
  alias = "seoul"
  kubernetes {
    host                   = data.aws_eks_cluster.seoul.endpoint
    cluster_ca_certificate = base64decode(data.aws_eks_cluster.seoul.certificate_authority[0].data)
    token                  = data.aws_eks_cluster_auth.seoul.token
  }
}

provider "helm" {
  alias = "tokyo"
  kubernetes {
    host                   = data.aws_eks_cluster.tokyo.endpoint
    cluster_ca_certificate = base64decode(data.aws_eks_cluster.tokyo.certificate_authority[0].data)
    token                  = data.aws_eks_cluster_auth.tokyo.token
  }
}
