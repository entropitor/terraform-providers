variables {
  project_name = "test-project"
}

run "create_project" {
  module {
    source = "./tests/create"
  }

}

run "import_project" {
  variables {
    project_id = run.create_project.project_id
  }

  assert {
    condition     = output.project_id == run.create_project.project_id
    error_message = "Didn't import the project correctly"
  }
}
