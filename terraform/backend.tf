# terraform/backend.tf

terraform {
  cloud {
    organization = "tlstprptlstprp" # 👈 여기에 실제 조직 이름 입력

    workspaces {
      name = "my-weather-app"
    }
  }
}
