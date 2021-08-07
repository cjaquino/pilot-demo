# The name of your project.
project = "pilot-todos"

# See the following for additional information on Waypoint's built-in GCR plugin:
# https://www.waypointproject.io/plugins/google-cloud-run

app "todos" {
  # The application entrypoint in relation to the root of your project/repo
  # example: path = "./sub_dir/my_app"
  path = "./todos"

  build {
    # Builds an image based off of your source code using Cloud Native Buildpacks
    use "pack" {}

    registry {
      # Pushes built image to Cloud Container Registry
      use "docker" {
        image = "gcr.io/gcp-pilot-testing/todos"
        tag   = "latest"
      }
    }
  }

  deploy {
    # Deploys application to Google Cloud Run
    use "google-cloud-run" {
      project  = "gcp-pilot-testing"
      location = "us-east1"

      # Port the application is listening on
      port = 3000

      capacity {
        memory                     = 128
        cpu_count                  = 1
        max_requests_per_container = 10
        request_timeout            = 300
      }

      auto_scaling {
        max = 2
      }
      
      vpc_access {
        connector = "pilot-vpc-connector"
        egress = "all"
      }
    }
  }

  release {
    # Releases application on Google Cloud Run
    use "google-cloud-run" {}
  }
}
