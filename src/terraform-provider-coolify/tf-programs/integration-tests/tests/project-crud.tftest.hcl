variables {
  project_name = "test-project"
}

run "create_project" {
  module {
    source = "./tests/create"
  }
}

run "update_the_name" {
  module {
    source = "./tests/create"
  }

  variables {
    project_name = "updated-project-name"
  }
}
