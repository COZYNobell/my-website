variable "ami_id" {
  type = string
}

variable "instance_type" {
  type = string
}

variable "security_group_ids" {
  type = list(string)
}

variable "vpc_subnets" {
  type = list(string)
}

variable "target_group_arn" {
  type = string
}

variable "db_host" {
  type = string
}
