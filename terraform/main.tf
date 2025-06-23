# terraform/main.tf

# -----------------------------------------------------------------------------
# AWS 공급자(Provider) 설정
# -----------------------------------------------------------------------------
# 각 리전에 대한 AWS 공급자를 '별칭(alias)'을 사용하여 정의합니다.
provider "aws" {
  region = "ap-northeast-2"
  alias  = "seoul"
}

provider "aws" {
  region = "ap-northeast-1"
  alias  = "tokyo"
}

# -----------------------------------------------------------------------------
# 모듈 호출 (Module Calls)
# -----------------------------------------------------------------------------

# 1. 서울 리전 모듈 호출
module "seoul" {
  source = "./envs/seoul"
  # 이 모듈 안의 모든 'aws' 리소스는 'seoul' 별칭을 가진 프로바이더를 사용하도록 전달합니다.
  providers = {
    aws = aws.seoul
  }

  # 서울 리전에 필요한 변수들을 전달합니다.
  vpc_cidr_block = "10.1.0.0/16" # 예시 CIDR
  db_name        = var.db_name_seoul
  db_password    = var.db_password
}

# 2. 도쿄 리전 모듈 호출
module "tokyo" {
  source = "./envs/tokyo"
  # 이 모듈 안의 모든 'aws' 리소스는 'tokyo' 별칭을 가진 프로바이더를 사용하도록 전달합니다.
  providers = {
    aws = aws.tokyo
  }

  # 도쿄 리전에 필요한 변수들을 전달합니다.
  vpc_cidr_block  = "10.2.0.0/16" # 예시 CIDR
  db_name         = var.db_name_tokyo
  db_password     = var.db_password
  
  # ✨ 도쿄 RDS 복제본이 서울 RDS를 참조하기 위해, 서울 모듈의 출력값을 전달합니다.
  primary_rds_arn = module.seoul.rds_arn 
}
