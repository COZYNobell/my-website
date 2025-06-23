resource "kubernetes_ingress_v1" "argocd_ingress_seoul" {
  metadata {
    name      = "argocd-ingress"
    namespace = "argocd"
    annotations = {
      "kubernetes.io/ingress.class"                      = "alb"
      "alb.ingress.kubernetes.io/scheme"                 = "internet-facing"
      "alb.ingress.kubernetes.io/target-type"            = "ip"
      "alb.ingress.kubernetes.io/listen-ports"           = "[{\"HTTPS\":443}]"
      "alb.ingress.kubernetes.io/certificate-arn"        = var.seoul_acm_arn
      "alb.ingress.kubernetes.io/group.name"             = "argocd"
      "external-dns.alpha.kubernetes.io/hostname"        = var.seoul_argocd_domain
    }
  }

  spec {
    rules {
      host = var.seoul_argocd_domain

      http {
        paths {
          path      = "/*"
          path_type = "ImplementationSpecific"

          backend {
            service {
              name = "argocd-server"
              port {
                number = 80
              }
            }
          }
        }
      }
    }
  }

  depends_on = [helm_release.argocd_seoul]
}

resource "kubernetes_ingress_v1" "argocd_ingress_tokyo" {
  metadata {
    name      = "argocd-ingress"
    namespace = "argocd"
    annotations = {
      "kubernetes.io/ingress.class"                      = "alb"
      "alb.ingress.kubernetes.io/scheme"                 = "internet-facing"
      "alb.ingress.kubernetes.io/target-type"            = "ip"
      "alb.ingress.kubernetes.io/listen-ports"           = "[{\"HTTPS\":443}]"
      "alb.ingress.kubernetes.io/certificate-arn"        = var.tokyo_acm_arn
      "alb.ingress.kubernetes.io/group.name"             = "argocd"
      "external-dns.alpha.kubernetes.io/hostname"        = var.tokyo_argocd_domain
    }
  }

  spec {
    rules {
      host = var.tokyo_argocd_domain

      http {
        paths {
          path      = "/*"
          path_type = "ImplementationSpecific"

          backend {
            service {
              name = "argocd-server"
              port {
                number = 80
              }
            }
          }
        }
      }
    }
  }

  depends_on = [helm_release.argocd_tokyo]
}
