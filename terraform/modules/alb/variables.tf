variable "vpc_id" {
  type        = string
  description = "The VPC ID for the ALB"
}

variable "public_subnet_ids" {
  type        = list(string)
  description = "Public subnets where ALB will be deployed"
}

variable "alb_sg_id" {
  type        = string
  description = "Security group ID for the ALB"
}

variable "acm_certificate_arn" {
  type        = string
  description = "ACM 인증서 ARN"
}
