resource "aws_eks_node_group" "alpha_nodegroup_seoul" {
  cluster_name    = aws_eks_cluster.alpha_eks_seoul.name
  node_group_name = "alpha-nodegroup-seoul"
  node_role_arn   = aws_iam_role.alpha_node_role.arn
  subnet_ids      = [
    "subnet-서울-public-id",
    "subnet-서울-private-id"
  ]
  instance_types  = ["t3.medium"]
  scaling_config {
    desired_size = 2
    max_size     = 3
    min_size     = 1
  }
  ami_type       = "AL2_x86_64"
  capacity_type  = "ON_DEMAND"

  remote_access {
    ec2_ssh_key = var.ec2_key_pair_name
  }

  depends_on = [
    aws_eks_cluster.alpha_eks_seoul,
    aws_iam_role_policy_attachment.alpha_worker_node_AmazonEKSWorkerNodePolicy,
    aws_iam_role_policy_attachment.alpha_worker_node_AmazonEC2ContainerRegistryReadOnly,
    aws_iam_role_policy_attachment.alpha_worker_node_AmazonEKS_CNI_Policy
  ]
}
