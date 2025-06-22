# terraform/variables.tf

variable "aws_region" {
  description = "The AWS region to deploy resources in."
  type        = string
  default     = "ap-northeast-2"
}

variable "cluster_name" {
  description = "The name of the EKS cluster."
  type        = string
  default     = "alpha-v2-cluster"
}

variable "app_server_sg_id" {
  description = "ID of the existing security group for App Servers / EKS Nodes."
  type        = string
  default     = "sg-0a8e19e9a5dcbaabd"
}

variable "monitoring_sg_id" {
  description = "ID of the existing security group for the Bastion Host."
  type        = string
  default     = "sg-0bd2e65ea873710fd"
}
