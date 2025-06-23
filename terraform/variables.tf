# --- 공통 도메인 / 인증서 ARN ---
variable "seoul_acm_arn" {
  description = "서울 리전 ACM 인증서 ARN"
  type        = string
}

variable "tokyo_acm_arn" {
  description = "도쿄 리전 ACM 인증서 ARN"
  type        = string
}

variable "seoul_argocd_domain" {
  description = "서울 ArgoCD 도메인"
  type        = string
}

variable "tokyo_argocd_domain" {
  description = "도쿄 ArgoCD 도메인"
  type        = string
}
