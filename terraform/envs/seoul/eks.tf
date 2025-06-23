provider "aws" {
  region = "ap-northeast-2"
}

resource "aws_eks_cluster" "alpha_eks_seoul" {
  name     = "alpha-eks-seoul"
  role_arn = aws_iam_role.eks_cluster_role.arn

  vpc_config {
    subnet_ids = [
      "rtb-00eef432a2da9e2b2",  # public
      "rtb-0d5184de1e7874f8a"   # private
    ]
    endpoint_private_access = true
    endpoint_public_access  = true
  }

  depends_on = [
    aws_iam_role_policy_attachment.eks_cluster_AmazonEKSClusterPolicy,
    aws_iam_role_policy_attachment.eks_cluster_AmazonEKSVPCResourceController
  ]
}

resource "aws_eks_node_group" "alpha_eks_seoul_nodes" {
  cluster_name    = aws_eks_cluster.alpha_eks_seoul.name
  node_group_name = "alpha-eks-seoul-nodes"
  node_role_arn   = aws_iam_role.eks_node_group_role.arn
  subnet_ids = [
    "rtb-0d5184de1e7874f8a"  # private only
  ]
  scaling_config {
    desired_size = 2
    max_size     = 3
    min_size     = 1
  }

  instance_types = ["t3.medium"]

  depends_on = [
    aws_eks_cluster.alpha_eks_seoul,
    aws_iam_role_policy_attachment.eks_node_AmazonEKSWorkerNodePolicy,
    aws_iam_role_policy_attachment.eks_node_AmazonEKS_CNI_Policy,
    aws_iam_role_policy_attachment.eks_node_AmazonEC2ContainerRegistryReadOnly
  ]
}
