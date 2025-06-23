module "argocd_tokyo" {
  source            = "../../modules/argocd"
  region            = "ap-northeast-1"
  cluster_name      = "eks-cluster-tokyo"
  argocd_namespace  = "argocd"
  values_file_path  = "${path.module}/argocd-values-tokyo.yaml"
}
