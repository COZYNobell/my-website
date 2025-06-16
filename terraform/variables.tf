# terraform/variables.tf

variable "aws_region" {
  description = "The AWS region to deploy resources in."
  type        = string
  default     = "ap-northeast-2"
}

variable "cluster_name" {
  description = "The name of the EKS cluster."
  type        = string
  default     = "my-weather-app-cluster"
}

variable "github_repository" {
  description = "The GitHub repository (owner/repo) for IAM role trust."
  type        = string
  default     = "COZYNobell/my-website"
}

variable "db_name" {
  description = "The name of the RDS database."
  type        = string
  default     = "master_db"
}

variable "db_username" {
  description = "The master username for the RDS database."
  type        = string
  default     = "admin"
}

variable "db_password" {
  description = "The master password for the RDS database."
  type        = string
  sensitive   = true
}
