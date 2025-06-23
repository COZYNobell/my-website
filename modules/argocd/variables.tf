variable "region" {
  type = string
}

variable "cluster_name" {
  type = string
}

variable "argocd_namespace" {
  type    = string
  default = "argocd"
}

variable "values_file_path" {
  type = string
}
