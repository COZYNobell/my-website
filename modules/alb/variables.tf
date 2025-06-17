# ~/terraform/modules/alb/variables.tf

variable "alb_name" {
  type        = string
  description = "Name for the ALB and related resources"
}

variable "vpc_id" {
  type        = string
  description = "VPC ID where the ALB is deployed"
}

variable "subnets" {
  type        = list(string)
  description = "List of subnet IDs to deploy the ALB"
}

variable "security_groups" {
  type        = list(string)
  description = "Security groups to attach to the ALB"
}
