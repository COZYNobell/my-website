module "argocd_seoul" {
  source            = "../../modules/argocd"
  region            = "ap-northeast-2"
  cluster_name      = "eks-cluster-seoul"
  argocd_namespace  = "argocd"
  values_file_path  = "${path.module}/argocd-values-seoul.yaml"
}
