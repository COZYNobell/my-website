resource "aws_acm_certificate" "this" {
  domain_name       = var.domain_name
  validation_method = "DNS"
  lifecycle {
    create_before_destroy = true
  }

  tags = {
    Name = "weather-app-cert"
  }
}

resource "aws_route53_record" "validation" {
  name    = tolist(aws_acm_certificate.this.domain_validation_options)[0].resource_record_name
  type    = tolist(aws_acm_certificate.this.domain_validation_options)[0].resource_record_type
  zone_id = var.route53_zone_id
  records = [tolist(aws_acm_certificate.this.domain_validation_options)[0].resource_record_value]
  ttl     = 300
}

resource "aws_acm_certificate_validation" "this" {
  certificate_arn         = aws_acm_certificate.this.arn
  validation_record_fqdns = [aws_route53_record.validation.fqdn]
}
