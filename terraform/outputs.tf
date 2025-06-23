output "seoul_eks_cluster_name" {
  value = aws_eks_cluster.alpha_eks_seoul.name
}

output "tokyo_eks_cluster_name" {
  value = aws_eks_cluster.alpha_eks_tokyo.name
}
