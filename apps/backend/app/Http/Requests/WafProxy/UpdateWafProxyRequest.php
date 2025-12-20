<?php

namespace App\Http\Requests\WafProxy;

use App\Models\WafProxy;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class UpdateWafProxyRequest extends FormRequest
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
      'name' => ['nullable', 'string', 'max:255'],
      'origin_url' => ['sometimes', 'string', 'max:2048', 'url:http,https'],
      'status' => ['sometimes', Rule::in([
        WafProxy::STATUS_ACTIVE,
        WafProxy::STATUS_PAUSED,
        WafProxy::STATUS_DISABLED,
      ])],
    ];
  }

  /**
   * Get custom messages for validator errors.
   *
   * @return array<string, string>
   */
  public function messages(): array
  {
    return [
      'origin_url.url' => 'The origin URL must be a valid HTTP or HTTPS URL.',
      'status.in' => 'The status must be one of: active, paused, disabled.',
    ];
  }
}
