variable "cluster_name" {
  type = string
}

variable "cluster_role_arn" {
  type = string
}

variable "subnet_ids" {
  type = list(string)
}

variable "k8s_version" {
  type    = string
  default = "1.29"
}

variable "enabled_log_types" {
  type    = list(string)
  default = ["api", "audit", "authenticator"]
}

variable "service_ipv4_cidr" {
  type    = string
  default = "172.20.0.0/16"
}

variable "tags" {
  type = map(string)
}
