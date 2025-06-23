output "eks_cluster_name" {
  description = "Name of the EKS Cluster"
  value       = aws_eks_cluster.alpha_eks.name
}

output "eks_cluster_endpoint" {
  description = "EKS Cluster endpoint"
  value       = aws_eks_cluster.alpha_eks.endpoint
}

output "eks_cluster_certificate" {
  description = "EKS Cluster Certificate Authority"
  value       = aws_eks_cluster.alpha_eks.certificate_authority[0].data
}
