<?php

namespace App\Http\Requests\WafProxy;

use Illuminate\Foundation\Http\FormRequest;

class StoreWafProxyRequest extends FormRequest
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
      'origin_url' => ['required', 'string', 'max:2048', 'url:http,https'],
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
      'origin_url.required' => 'The origin URL is required.',
      'origin_url.url' => 'The origin URL must be a valid HTTP or HTTPS URL.',
    ];
  }
}
