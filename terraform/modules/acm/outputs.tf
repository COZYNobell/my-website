output "certificate_arn" {
  value       = aws_acm_certificate.this.arn
  description = "ACM 인증서 ARN"
}
