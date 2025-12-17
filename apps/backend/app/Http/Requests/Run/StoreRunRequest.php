<?php

namespace App\Http\Requests\Run;

use App\Models\Run;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class StoreRunRequest extends FormRequest
{
  /**
   * Determine if the user is authorized to make this request.
   */
  public function authorize(): bool
  {
    return true;
  }

  /**
   * Get the validation rules that apply to the request.
   *
   * @return array<string, \Illuminate\Contracts\Validation\ValidationRule|array<mixed>|string>
   */
  public function rules(): array
  {
    return [
      'module' => [
        'required',
        'string',
        Rule::in([
          Run::MODULE_WEB_SECURITY,
          Run::MODULE_MONITORING_IR,
          Run::MODULE_IAM,
        ]),
      ],
      'target_type' => ['required', 'string', 'in:url,repo,config'],
      'target_value' => ['required', 'string', 'max:2048'],
      'meta' => ['nullable', 'array'],
    ];
  }

  /**
   * Custom validation messages.
   */
  public function messages(): array
  {
    return [
      'module.in' => 'Invalid module type. Must be one of: web_security, monitoring_ir, iam',
      'target_type.in' => 'Invalid target type. Must be one of: url, repo, config',
    ];
  }
}

