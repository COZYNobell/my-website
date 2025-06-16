variable "route53_zone_id" {
  description = "Route53 hosted zone ID"
  type        = string
}

variable "record_name" {
  description = "도메인 레코드 이름 (예: app.example.com)"
  type        = string
}

variable "alb_dns_name" {
  description = "ALB DNS 이름"
  type        = string
}

variable "alb_zone_id" {
  description = "ALB의 hosted zone ID"
  type        = string
}

