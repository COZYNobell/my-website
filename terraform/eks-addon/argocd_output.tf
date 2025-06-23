output "argocd_seoul_server" {
  value = module.eks_seoul.eks_cluster_endpoint
}

output "argocd_tokyo_server" {
  value = module.eks_tokyo.eks_cluster_endpoint
}

output "argocd_seoul_lb_hostname" {
  value = try(
    helm_release.argocd_seoul.metadata[0].name != "" ?
    data.kubernetes_service.argocd_seoul.metadata.0.annotations["external-dns.alpha.kubernetes.io/hostname"] : "",
    ""
  )
}

output "argocd_tokyo_lb_hostname" {
  value = try(
    helm_release.argocd_tokyo.metadata[0].name != "" ?
    data.kubernetes_service.argocd_tokyo.metadata.0.annotations["external-dns.alpha.kubernetes.io/hostname"] : "",
    ""
  )
}
