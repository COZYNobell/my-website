# ~/terraform/modules/autoscaling/variables.tf

variable "ami_id" {
  type        = string
  description = "AMI ID to use for the EC2 instances"
}

variable "instance_type" {
  type        = string
  default     = "t3.micro"
  description = "Instance type for the EC2 instances"
}

variable "security_group_ids" {
  type        = list(string)
  description = "List of security group IDs for the launch template"
}

variable "vpc_subnets" {
  type        = list(string)
  description = "List of subnet IDs for the Auto Scaling Group"
}

variable "target_group_arn" {
  type        = string
  description = "ARN of the ALB target group to attach"
}

variable "db_host" {
  type        = string
  description = "RDS endpoint to inject into EC2 instances via user_data"
}

variable "desired_capacity" {
  type    = number
  default = 2
}

variable "min_size" {
  type    = number
  default = 1
}

variable "max_size" {
  type    = number
  default = 3
}
